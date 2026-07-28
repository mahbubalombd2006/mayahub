import sys
import random

from PyQt6.QtWidgets import *
from docx import Document

from supabase import create_client



# =====================================
# SUPABASE DATABASE
# =====================================

SUPABASE_URL = "https://enjgfpkjkvbvmofhotmo.supabase.co"

SUPABASE_KEY = "sb_publishable_QxzdSPEKE8XQ3pum3E_qmA_2Yl-N0JN"


supabase = create_client(
    SUPABASE_URL,
    SUPABASE_KEY
)



# =====================================
# GET TRANSACTIONS
# =====================================

def get_transactions(limit=100):

    result = (
        supabase
        .table("transactions")
        .select("*")
        .limit(1000)
        .execute()
    )


    data = result.data


    if len(data) > limit:

        data = random.sample(
            data,
            limit
        )


    return data





# =====================================
# GENERATE WORD STATEMENT
# =====================================


def generate_docx(
        template,
        transactions,
        output
):


    doc = Document(template)



    # Find Statement Table

    table = doc.tables[0]


    balance = 0


    row_index = 1



    for trn in transactions:



        if row_index >= len(table.rows):

            table.add_row()



        row = table.rows[row_index]



        debit = float(
            trn.get(
                "debits",
                0
            )
        )


        credit = float(
            trn.get(
                "credits",
                0
            )
        )



        balance = (
            balance
            +
            credit
            -
            debit
        )



        values = [

            str(
                trn.get(
                    "trn_date",
                    ""
                )
            ),


            str(
                trn.get(
                    "brn",
                    ""
                )
            ),


            str(
                trn.get(
                    "descriptions",
                    ""
                )
            ),


            str(
                trn.get(
                    "references_no",
                    ""
                )
            ),


            "{:,.2f}".format(
                debit
            ),


            "{:,.2f}".format(
                credit
            ),


            "{:,.2f}".format(
                balance
            )

        ]



        for i,value in enumerate(values):


            if i < len(row.cells):

                row.cells[i].text = value



        row_index += 1




    doc.save(
        output
    )






# =====================================
# GUI
# =====================================


class Window(QWidget):


    def __init__(self):

        super().__init__()


        self.template = ""


        self.setWindowTitle(
            "Bank Statement Generator"
        )


        self.resize(
            600,
            450
        )



        layout = QVBoxLayout()



        title = QLabel(
            "Bank Statement Generator"
        )


        title.setStyleSheet(
            """
            font-size:24px;
            font-weight:bold;
            """
        )


        layout.addWidget(
            title
        )



        self.template_btn = QPushButton(
            "Select Bank Template"
        )


        self.template_btn.clicked.connect(
            self.select_template
        )


        layout.addWidget(
            self.template_btn
        )



        layout.addWidget(
            QLabel(
                "Total Transaction"
            )
        )



        self.qty = QSpinBox()


        self.qty.setRange(
            1,
            5000
        )


        self.qty.setValue(
            100
        )


        layout.addWidget(
            self.qty
        )



        self.generate_btn = QPushButton(
            "Generate Statement DOCX"
        )


        self.generate_btn.clicked.connect(
            self.generate
        )


        layout.addWidget(
            self.generate_btn
        )



        self.setLayout(
            layout
        )





    def select_template(self):


        file,_ = QFileDialog.getOpenFileName(

            self,

            "Select Word Template",

            "",

            "DOCX (*.docx)"

        )



        if file:


            self.template = file


            self.template_btn.setText(
                file
            )






    def generate(self):


        if self.template == "":


            QMessageBox.warning(

                self,

                "Error",

                "Select Template First"

            )

            return




        transactions = get_transactions(

            self.qty.value()

        )



        save,_ = QFileDialog.getSaveFileName(

            self,

            "Save Statement",

            "Generated_Statement.docx",

            "DOCX (*.docx)"

        )



        if save:


            generate_docx(

                self.template,

                transactions,

                save

            )



            QMessageBox.information(

                self,

                "Success",

                "Statement Created"

            )






# =====================================
# START PROGRAM
# =====================================


app = QApplication(sys.argv)


window = Window()


window.show()


sys.exit(
    app.exec()
)